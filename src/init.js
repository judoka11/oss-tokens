// `oss-tokens init` and `oss-tokens uninstall`. Every change init makes is
// recorded in ~/.oss-tokens/installed.json so uninstall can undo exactly that.
import { createInterface } from 'node:readline/promises';
import { existsSync, rmSync, cpSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { TASK_TYPES, dataDir, loadConfig, saveConfig, readJson, writeJson } from './config.js';
import { PLATFORMS, addEntry, removeEntry, writeSkill, skillDir, genericSnippet } from './platforms.js';
import { VERSION, readInstructions } from './mcp-server.js';
import { detectMachine, describeMachine } from './machine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestFile = () => join(dataDir(), 'installed.json');

async function ask(question, fallback = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(fallback ? `${question} [${fallback}] ` : `${question} `)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

// Reads a secret without echoing it.
async function askSecret(question) {
  if (!process.stdin.isTTY) return ask(question);
  process.stdout.write(`${question} `);
  return new Promise((resolve) => {
    let value = '';
    const done = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
    };
    const onData = (buf) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') { done(); process.stdout.write('\n'); return resolve(value.trim()); }
        if (ch === '\u0003') { done(); process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f' || ch === '\b') {
          if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        value += ch;
        process.stdout.write('*');
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

function list(value, allowed) {
  const items = String(value || '').split(',').map(s => s.trim()).filter(Boolean);
  const bad = allowed ? items.filter(i => !allowed.includes(i)) : [];
  if (bad.length) throw new Error(`Unknown: ${bad.join(', ')}. Choose from: ${allowed.join(', ')}`);
  return items;
}

// The MCP entry must run a fixed copy of the code. Run through npx (from
// npm or straight from GitHub), we copy the exact code that is running,
// dependencies included, to ~/.oss-tokens/pkg/<version>, so a later npx
// download can never change what your tools run. From a git checkout we
// point at the checkout (development).
function resolveServer() {
  const fromNpx = /[\\/]_npx[\\/]/.test(ROOT) && basename(dirname(ROOT)) === 'node_modules';
  if (!fromNpx) {
    return { command: process.execPath, args: [join(ROOT, 'src', 'cli.js'), 'mcp'], pkgDir: null };
  }
  const pkgDir = join(dataDir(), 'pkg', VERSION);
  rmSync(pkgDir, { recursive: true, force: true });
  cpSync(dirname(ROOT), join(pkgDir, 'node_modules'), { recursive: true });
  return { command: process.execPath, args: [join(pkgDir, 'node_modules', basename(ROOT), 'src', 'cli.js'), 'mcp'], pkgDir };
}

// Classic tokens report their scopes in a header; fine-grained ones don't.
async function checkToken(token) {
  const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'oss-tokens' } });
  if (!res.ok) throw new Error(`GitHub rejected the token (HTTP ${res.status}).`);
  const user = await res.json();
  return { login: user.login, scopes: res.headers.get('x-oauth-scopes') };
}

export async function runInit(flags = {}) {
  const yes = !!flags.yes;
  const current = loadConfig();
  console.log(`\noss-tokens ${VERSION}: donate your coding agent's time to open source.\n`);

  // 1. GitHub token
  let token = flags.token ?? current.github_token;
  if (!yes && !token) {
    console.log('A GitHub token lets your agent claim tasks and post results under your name.');
    console.log('Create a classic token with only the "public_repo" scope: https://github.com/settings/tokens/new?scopes=public_repo&description=oss-tokens');
    console.log('Leave empty to only browse tasks for now.');
    token = (await askSecret('GitHub token:')) || null;
  }
  let login = null;
  if (token) {
    const info = await checkToken(token);
    login = info.login;
    console.log(`✓ Token works: signed in as @${login}`);
    if (info.scopes !== null && !/\b(public_repo|repo)\b/.test(info.scopes)) {
      console.log(`! This token has scopes "${info.scopes || 'none'}". Posting comments needs public_repo.`);
    }
  }

  // 2. Which tools
  const detected = Object.keys(PLATFORMS).filter(id => PLATFORMS[id].detect());
  let tools = flags.tools ? list(flags.tools, Object.keys(PLATFORMS)) : detected;
  if (!yes) {
    const names = Object.entries(PLATFORMS).map(([id, p]) => `${id}${detected.includes(id) ? ' (found)' : ''}`).join(', ');
    console.log(`\nAI tools: ${names}`);
    tools = list(await ask('Set up which (comma-separated)?', tools.join(',')), Object.keys(PLATFORMS));
  }

  // 3. Preferences
  let taskTypes = flags['task-types'] ? list(flags['task-types'], TASK_TYPES) : current.task_types;
  let languages = flags.languages !== undefined ? list(flags.languages) : current.languages;
  let dailyLimit = flags['daily-limit'] ? Number(flags['daily-limit']) : current.daily_task_limit;
  if (!yes) {
    console.log(`\nTask types: ${TASK_TYPES.join(', ')}`);
    taskTypes = list(await ask('Which task types do you want?', taskTypes.join(',')), TASK_TYPES);
    languages = list(await ask('Preferred repo languages, e.g. Python,TypeScript (empty = any)?', languages.join(',')));
    dailyLimit = Number(await ask('Max tasks per day?', String(dailyLimit)));
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1) throw new Error('Max tasks per day must be a whole number, 1 or more.');

  // 3b. This machine, for platform-specific tasks
  const machine = await detectMachine();
  console.log(`\nThis machine: ${describeMachine(machine)}`);
  console.log('Results you post will mention this, so maintainers know where a bug was (or wasn\'t) reproduced.');
  let allowNative = flags['allow-native'] ?? current.verify.allow_native_platform_tasks;
  if (!yes) {
    console.log('\nSome bugs only happen on one OS or GPU and can\'t be checked in a Docker sandbox.');
    console.log('For tasks tagged for your machine, oss-tokens can run the repo\'s checks directly here,');
    console.log('without a sandbox, asking you before every run. Only approve repos you trust.');
    allowNative = /^y(es)?$/i.test(await ask('Allow that (y/n)?', allowNative ? 'y' : 'n'));
  }

  // 4. Confirm
  const plan = [
    ...tools.map(id => `${PLATFORMS[id].file()}  (add "oss-tokens" MCP server for ${PLATFORMS[id].label})`),
    ...(tools.includes('claude-code') ? [`${join(skillDir(), 'SKILL.md')}  (/oss-task skill)`] : []),
    `${join(dataDir(), 'config.json')}  (your settings${token ? ' and token' : ''})`,
    `${manifestFile()}  (list of changes, for uninstall)`,
  ];
  console.log('\nAbout to write:\n' + plan.map(p => `  • ${p}`).join('\n'));
  if (!yes && !/^y(es)?$/i.test(await ask('\nWrite these files? (y/n)', 'y'))) {
    console.log('Nothing written.');
    return;
  }

  // 5. Write
  const server = resolveServer();
  const changes = [];
  for (const id of tools) {
    try {
      changes.push(addEntry(id, server));
      console.log(`✓ ${PLATFORMS[id].label}`);
    } catch (err) {
      console.log(`✗ ${PLATFORMS[id].label}: ${err.message}\n${genericSnippet(server)}`);
    }
  }
  const skill = tools.includes('claude-code') ? writeSkill(readInstructions('workflow')) : null;
  saveConfig({
    ...current, github_token: token, task_types: taskTypes, languages, daily_task_limit: dailyLimit, github_login: login,
    machine, verify: { ...current.verify, allow_native_platform_tasks: !!allowNative },
  });

  const previous = readJson(manifestFile(), { changes: [] });
  const merged = [...previous.changes.filter(c => !changes.some(n => n.file === c.file)), ...changes];
  writeJson(manifestFile(), { version: VERSION, installed_at: new Date().toISOString(), server, changes: merged, skill_dir: skill || previous.skill_dir || null, pkg_dir: server.pkgDir });

  console.log(`\n✓ Done. Restart your AI tool, then:`);
  if (tools.includes('claude-code')) console.log('  Claude Code: type /oss-task');
  console.log('  Other tools: use the "do-task" prompt from the oss-tokens server, or ask "find me an oss-tokens task".');
  console.log('\nOther MCP tools can use this entry:\n' + genericSnippet(server));
  console.log('\nRemove everything later with: npx oss-tokens uninstall\n');
}

export async function runUninstall(flags = {}) {
  const manifest = readJson(manifestFile(), null);
  const changes = manifest?.changes?.length
    ? manifest.changes
    : Object.entries(PLATFORMS).map(([platform, p]) => ({ platform, file: p.file(), keyPath: p.keyPath, createdFile: false }));

  for (const change of changes) {
    try {
      if (removeEntry(change)) console.log(`✓ removed oss-tokens from ${change.file}`);
    } catch (err) {
      console.log(`✗ ${change.file}: ${err.message}`);
    }
  }
  const skill = manifest?.skill_dir || skillDir();
  if (existsSync(skill)) {
    rmSync(skill, { recursive: true, force: true });
    console.log(`✓ removed ${skill}`);
  }
  const workspaces = join(tmpdir(), 'oss-tokens');
  if (existsSync(workspaces)) {
    rmSync(workspaces, { recursive: true, force: true });
    console.log(`✓ removed task workspaces in ${workspaces}`);
  }
  if (flags['keep-config']) {
    rmSync(manifestFile(), { force: true });
    if (manifest?.pkg_dir) rmSync(manifest.pkg_dir, { recursive: true, force: true });
    console.log(`Kept your settings and history in ${dataDir()}`);
  } else if (existsSync(dataDir())) {
    rmSync(dataDir(), { recursive: true, force: true });
    console.log(`✓ removed ${dataDir()} (settings, token, history)`);
  }
  console.log('\noss-tokens is uninstalled. Restart your AI tools. If you made a GitHub token for it, you can delete it at https://github.com/settings/tokens');
}
