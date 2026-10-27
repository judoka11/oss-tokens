// The comment protocol from SPEC.md section 3: hidden markers in issue
// comments say who is working on a task. Pure functions, easy to test.

export const TOOL_URL = 'https://github.com/judoka11/oss-tokens';
export const MAINTAINER_DOC_URL = `${TOOL_URL}/blob/main/docs/for-maintainers.md`;
const MARKER_RE = /<!--\s*oss-tokens:(claim|release|result)\s+v1\b[^>]*-->/;

export function marker(kind) {
  return `<!-- oss-tokens:${kind} v1 -->`;
}

export function markerKind(body) {
  const m = MARKER_RE.exec(body || '');
  return m ? m[1] : null;
}

// Walks comments oldest first. A claim stays active for claimHours unless
// the same author later releases it or posts a result. Returns every active
// claim, earliest first; the first one owns the task.
export function activeClaims(comments, { claimHours = 24, now = new Date() } = {}) {
  const open = new Map(); // login -> claim
  const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const c of sorted) {
    const kind = markerKind(c.body);
    const login = c.user?.login;
    if (!kind || !login) continue;
    if (kind === 'claim') {
      if (!open.has(login)) {
        const created = new Date(c.created_at);
        open.set(login, {
          login,
          created_at: created.toISOString(),
          expires_at: new Date(created.getTime() + claimHours * 3600_000).toISOString(),
          comment_url: c.html_url,
        });
      }
    } else {
      open.delete(login);
    }
  }
  return [...open.values()]
    .filter(c => new Date(c.expires_at) > now)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function taskOwner(comments, opts) {
  return activeClaims(comments, opts)[0] || null;
}

export function claimComment({ login, claimHours }) {
  return [
    marker('claim'),
    `🤖 @${login} is working on this with their AI coding agent via [oss-tokens](${TOOL_URL}).`,
    `This claim expires in ${claimHours}h if no result is posted.`,
  ].join('\n');
}

export function releaseComment({ login, reason }) {
  const why = reason ? ` Reason: ${oneLine(reason, 300)}` : '';
  return `${marker('release')}\n@${login} released this task; it's open for someone else.${why}`;
}

// format "standard": the AI-written summary is the body; an optional note
// from the donor goes first. format "quoted": the donor's own words are the
// body and the AI output is a clearly marked quote under them.
// donorMachine: where the agent ran. checkedIn: where the project's code
// actually ran (a Linux container is not the donor's Windows machine).
export function resultComment({ login, taskType, model, estimatedTokens, summary, patch, humanSummary = '', format = 'standard', donorMachine = '', checkedIn = '' }) {
  const tokens = estimatedTokens ? ` · ~${formatTokens(estimatedTokens)} tokens` : '';
  const human = humanSummary.trim();
  const where = [
    donorMachine && `Donor machine: ${oneLine(donorMachine, 120)}`,
    checkedIn && `Checks ran in: ${oneLine(checkedIn, 120)}`,
  ].filter(Boolean).join(' · ');
  const parts = [
    marker('result'),
    `> 🤖 **AI-assisted contribution** via [oss-tokens](${TOOL_URL}) · task: \`${taskType}\` · model: \`${oneLine(model, 80)}\`${tokens}`,
    `> Made by an AI agent on @${login}'s machine and reviewed by them before posting.`,
    ...(where ? [`> ${where}`] : []),
    '',
  ];
  if (format === 'quoted') {
    parts.push(
      `**@${login}:** ${human}`,
      '',
      `<details open><summary>AI-generated analysis (quoted)</summary>`,
      '',
      summary.trim().split('\n').map(line => `> ${line}`).join('\n'),
      '',
      '</details>',
    );
  } else {
    if (human) parts.push(`**Note from @${login}:** ${human}`, '');
    parts.push(summary.trim());
  }
  if (patch) {
    const fence = patch.includes('```') ? '````' : '```';
    parts.push('', '<details><summary>Patch (git diff)</summary>', '', `${fence}diff`, patch.trimEnd(), fence, '', '</details>');
  }
  parts.push('', `<sub>What is this? [About oss-tokens for maintainers](${MAINTAINER_DOC_URL}). Remove the \`ai-help-wanted\` label to stop it for this issue.</sub>`);
  return parts.join('\n');
}

function oneLine(text, max) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function formatTokens(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}
