#!/usr/bin/env node
import { parseArgs } from 'node:util';

const HELP = `oss-tokens: donate your coding agent's time to open source

Usage:
  npx oss-tokens init          set up for Claude Code, Cursor, OpenCode
  npx oss-tokens uninstall     remove everything init added (--keep-config keeps settings)
  npx oss-tokens find          list open tasks (--language Python --repo owner/name)
  npx oss-tokens status        show your settings and history
  npx oss-tokens mcp           run the MCP server (your AI tool does this)

init flags (for scripts): --yes --token <t> --tools claude-code,cursor
  --task-types repro,triage --languages Python --daily-limit 3 --allow-native
`;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
  options: {
    yes: { type: 'boolean' },
    token: { type: 'string' },
    tools: { type: 'string' },
    'task-types': { type: 'string' },
    languages: { type: 'string' },
    'daily-limit': { type: 'string' },
    'keep-config': { type: 'boolean' },
    'allow-native': { type: 'boolean' },
    language: { type: 'string' },
    repo: { type: 'string' },
    mcp: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});

const command = flags.mcp ? 'mcp' : positionals[0];

try {
  if (command === 'mcp') {
    const { startServer } = await import('./mcp-server.js');
    await startServer();
  } else if (command === 'init') {
    const { runInit } = await import('./init.js');
    await runInit(flags);
  } else if (command === 'uninstall') {
    const { runUninstall } = await import('./init.js');
    await runUninstall(flags);
  } else if (command === 'find') {
    const { loadConfig } = await import('./config.js');
    const { GitHub } = await import('./github.js');
    const { findTasks } = await import('./tasks.js');
    const { basicMachine } = await import('./machine.js');
    const config = loadConfig();
    const { tasks, skippedRepos, skippedForMachine } = await findTasks(new GitHub(config.github_token), {
      languages: flags.language ? [flags.language] : config.languages,
      taskTypes: config.task_types,
      repo: flags.repo || null,
      limit: 20,
      machine: config.machine || basicMachine(),
    });
    if (!tasks.length) console.log('No open tasks match right now.');
    for (const t of tasks) console.log(`${t.repo}#${t.issue}  [${t.task_type}${t.needs.length ? `, needs ${t.needs.join('+')}` : ''}]  ${t.title}\n  ${t.url}`);
    if (skippedForMachine) console.log(`(${skippedForMachine} hidden: they need hardware this machine doesn't have)`);
    for (const [repo, why] of Object.entries(skippedRepos)) console.log(`(skipped ${repo}: ${why})`);
  } else if (command === 'status') {
    const { loadConfig, loadState, dataDir } = await import('./config.js');
    const c = loadConfig();
    const s = loadState();
    console.log(`Settings: ${dataDir()}`);
    console.log(`GitHub: ${c.github_token ? `token set${c.github_login ? ` (@${c.github_login})` : ''}` : 'no token (browse only)'}`);
    console.log(`Task types: ${c.task_types.join(', ')} · languages: ${c.languages.join(', ') || 'any'} · max ${c.daily_task_limit}/day`);
    const { describeMachine, basicMachine } = await import('./machine.js');
    console.log(`Machine: ${describeMachine(c.machine || basicMachine())} · native checks for platform tasks: ${c.verify.allow_native_platform_tasks ? 'allowed (asks each time)' : 'off'}`);
    console.log(`Results posted: ${s.submissions.length}`);
    for (const x of s.submissions.slice(-10)) console.log(`  ${x.submitted_at.slice(0, 10)} ${x.repo}#${x.issue} [${x.task_type}] ${x.url}`);
  } else if (flags.version) {
    const { VERSION } = await import('./mcp-server.js');
    console.log(VERSION);
  } else {
    console.log(HELP);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
