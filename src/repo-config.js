// Reads and validates a repo's .github/ai-tasks.yml (see SPEC.md).
import { parse } from 'yaml';
import { z } from 'zod';
import { TASK_TYPES } from './config.js';

export const CONFIG_PATHS = ['.github/ai-tasks.yml', '.github/ai-tasks.yaml'];

const schema = z.object({
  version: z.literal(1).optional(),
  ai_help: z.boolean(),
  policy: z.string().max(500).optional(),
  allowed_tasks: z.array(z.enum(TASK_TYPES)).min(1).default(['repro', 'triage']),
  pull_requests: z.enum(['none', 'draft-only', 'allowed']).default('none'),
  // standard: the AI-written result is the comment.
  // quoted: the donor's own words lead, the AI output follows as a marked
  // quote (for policies that ban AI-written comments from personal accounts).
  result_format: z.enum(['standard', 'quoted']).default('standard'),
  verify: z.object({
    image: z.string().regex(/^[a-z0-9][a-z0-9._\/:@-]{0,200}$/, 'not a valid Docker image name').optional(),
    command: z.string().min(1).max(1000),
  }).optional(),
  limits: z.object({
    per_donor_open: z.number().int().min(1).max(20).default(1),
    claim_hours: z.number().min(1).max(24 * 14).default(24),
  }).default({ per_donor_open: 1, claim_hours: 24 }),
  notes: z.string().max(2000).optional(),
});

// Returns { ok: true, config } or { ok: false, error }.
export function parseRepoConfig(text) {
  let raw;
  try {
    raw = parse(text);
  } catch (err) {
    return { ok: false, error: `ai-tasks.yml is not valid YAML: ${err.message}` };
  }
  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, error: `ai-tasks.yml is invalid: ${issues}` };
  }
  if (!result.data.ai_help) return { ok: false, error: 'ai-tasks.yml has ai_help: false' };
  return { ok: true, config: result.data };
}

// The policy field is either a URL or a file path in the repo, optionally
// with a #section. Returns the repo path to fetch, or null for a URL.
export function policyPath(policy) {
  if (!policy || /^https?:\/\//i.test(policy)) return null;
  const path = policy.split('#')[0].replace(/^\.?\//, '');
  if (!/^[\w.\/-]{1,200}$/.test(path) || path.includes('..')) return null;
  return path;
}

// Fetches and parses a repo's config. Caches per process: configs rarely
// change during one agent session and search results repeat repos a lot.
const cache = new Map();

export async function fetchRepoConfig(gh, repo, { fresh = false } = {}) {
  if (!fresh && cache.has(repo)) return cache.get(repo);
  let result = { ok: false, error: 'No .github/ai-tasks.yml: this repo has not opted in.' };
  for (const path of CONFIG_PATHS) {
    const text = await gh.getFile(repo, path);
    if (text !== null) {
      result = parseRepoConfig(text);
      break;
    }
  }
  cache.set(repo, result);
  return result;
}
