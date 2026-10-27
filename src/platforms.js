// Where each AI tool keeps its MCP server list, and how to add or remove our
// entry without touching anything else in those files.
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { home, writeJson, NPX } from './config.js';

export const SERVER_NAME = 'oss-tokens';

export const PLATFORMS = {
  'claude-code': {
    label: 'Claude Code',
    detect: () => existsSync(join(home(), '.claude')) || existsSync(join(home(), '.claude.json')),
    file: () => join(home(), '.claude.json'),
    keyPath: ['mcpServers', SERVER_NAME],
    entry: ({ command, args }) => ({ type: 'stdio', command, args, env: {} }),
  },
  cursor: {
    label: 'Cursor',
    detect: () => existsSync(join(home(), '.cursor')),
    file: () => join(home(), '.cursor', 'mcp.json'),
    keyPath: ['mcpServers', SERVER_NAME],
    entry: ({ command, args }) => ({ command, args }),
  },
  opencode: {
    label: 'OpenCode',
    detect: () => existsSync(join(home(), '.config', 'opencode')),
    file: () => join(home(), '.config', 'opencode', 'opencode.json'),
    keyPath: ['mcp', SERVER_NAME],
    entry: ({ command, args }) => ({ type: 'local', command: [command, ...args], enabled: true }),
  },
};

// For tools not listed above: the common mcpServers JSON shape.
export function genericSnippet({ command, args }) {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: { command, args } } }, null, 2);
}

function readConfigFile(file) {
  if (!existsSync(file)) return { data: {}, existed: false };
  const raw = readFileSync(file, 'utf8');
  if (!raw.trim()) return { data: {}, existed: true };
  try {
    return { data: JSON.parse(raw), existed: true };
  } catch {
    throw new Error(`${file} isn't plain JSON (it may contain comments), so it wasn't changed. Add the entry by hand.`);
  }
}

// Adds our entry at keyPath. Returns what uninstall needs to undo it.
export function addEntry(platformId, server) {
  const p = PLATFORMS[platformId];
  const file = p.file();
  const { data, existed } = readConfigFile(file);
  const parentKey = p.keyPath[0];
  const createdParent = typeof data[parentKey] !== 'object' || data[parentKey] === null;
  if (createdParent) data[parentKey] = {};
  data[parentKey][p.keyPath[1]] = p.entry(server);
  writeJson(file, data);
  return { platform: platformId, file, keyPath: p.keyPath, createdFile: !existed, createdParent };
}

// Removes our entry. Also removes the parent section and the file, but only
// if init created them and they're now empty.
export function removeEntry({ file, keyPath, createdFile, createdParent = false }) {
  if (!existsSync(file)) return false;
  const { data } = readConfigFile(file);
  let node = data;
  for (const key of keyPath.slice(0, -1)) {
    node = node?.[key];
    if (!node) return false;
  }
  const last = keyPath.at(-1);
  if (!(last in node)) return false;
  delete node[last];
  if (createdParent && Object.keys(node).length === 0) delete data[keyPath[0]];
  if (createdFile && Object.keys(data).length === 0) rmSync(file);
  else writeJson(file, data);
  return true;
}

// Claude Code also gets skills, so /oss-task and /oss-practice work as
// slash commands.
export const SKILLS = {
  'oss-task': {
    description: 'Donate agent time to an open source project through oss-tokens. Find a task a maintainer posted, do it in a sandboxed workspace, and post the result after the user approves. Use when the user wants to contribute to open source with their spare tokens.',
    tools: 'find_tasks, get_task, search_repo_issues, claim_task, get_instructions, prepare_workspace, run_verify, run_native_check, submit_result, release_task',
    instructions: 'workflow',
  },
  'oss-practice': {
    description: 'Practice oss-tokens on a real issue of any public repo, sandboxed in Docker, saving the result to a local file instead of posting it. Use when the user wants to try a task on a project that has not opted in, or show a project what it would get.',
    tools: 'practice_get_task, search_repo_issues, get_instructions, practice_workspace, practice_run, practice_save',
    instructions: 'practice',
  },
};

export function skillDir(name = 'oss-task') {
  return join(home(), '.claude', 'skills', name);
}

export function writeSkill(name, instructionsText) {
  const skill = SKILLS[name];
  const dir = skillDir(name);
  mkdirSync(dir, { recursive: true });
  const content = [
    '---',
    `name: ${name}`,
    `description: ${skill.description}`,
    '---',
    '',
    `Use the tools from the \`oss-tokens\` MCP server (${skill.tools}). If they are missing, tell the user to run \`${NPX} init\` and restart Claude Code.`,
    '',
    instructionsText,
  ].join('\n');
  writeFileSync(join(dir, 'SKILL.md'), content, 'utf8');
  return dir;
}
