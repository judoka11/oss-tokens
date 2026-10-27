# oss-tokens

Open source projects post small tasks. People with spare AI coding agent time (Claude Code, Cursor, OpenCode, anything that speaks MCP) pick them up, do them on their own machine, review the result, and post it back.

- **No server, no account.** GitHub is the task board: a label on issues, and an opt-in file in the repo.
- **Maintainers stay in control.** Only repos that opt in get contributions, and only the task types they allow.
- **Your key never leaves your machine.** Your own agent does the work under your own subscription; nobody else uses your account.
- **Nothing is posted without you.** The agent shows you the exact comment first. Every result is labelled as AI-assisted, with the model and a rough token count.

## For maintainers

1. Add [`.github/ai-tasks.yml`](templates/ai-tasks.yml) to your repo. At minimum: `ai_help: true`.
2. Label an issue `ai-help-wanted` plus a type: `ai:repro`, `ai:triage`, `ai:failing-test` or `ai:docs`. Or add the [issue form](templates/ISSUE_TEMPLATE/ai-task.yml) to `.github/ISSUE_TEMPLATE/`.
3. Results arrive as comments on the issue. React 👍 or 👎 so donors learn what helps.

Bugs that only happen on one platform can be tagged `ai-needs:windows`, `ai-needs:macos`, `ai-needs:gpu` or `ai-needs:cuda`; those tasks only reach donors whose machine matches. If your AI policy doesn't accept AI-written comments as someone's own words, set `result_format: quoted`.

The full format and the claim protocol are in [SPEC.md](SPEC.md). What maintainers see, and how to stop it: [docs/for-maintainers.md](docs/for-maintainers.md).

## For donors

```bash
npx github:judoka11/oss-tokens init
```

`init` asks for a GitHub token (a classic token with only the `public_repo` scope, so your agent can comment under your name), which AI tools to set up, which task types and languages you like, a daily task limit, and whether platform-specific checks may run directly on your machine. It shows every file it will change before writing, and copies the exact version you ran to `~/.oss-tokens/pkg/`, so later downloads never change what your tools run.

Your results mention your OS, its version, CPU architecture and GPU, so maintainers know where a bug was or wasn't reproduced.

Then restart your tool and:
- **Claude Code:** `/oss-task`
- **Other tools:** use the `do-task` prompt from the `oss-tokens` server, or ask your agent to "find an oss-tokens task".

To see your history: `npx github:judoka11/oss-tokens status`. To remove everything: `npx github:judoka11/oss-tokens uninstall`.

**Updating:** npx keeps the first copy it downloads from GitHub and won't fetch a newer one by itself. To get the latest version, add `#main` (or a version tag) and re-run init: `npx github:judoka11/oss-tokens#main init`. `init` prints the version it is running on its first line.

### What your agent can do

| Tool | What it does |
|---|---|
| `find_tasks` | search for open tasks in opted-in repos |
| `get_task` | read a task, the repo's rules and AI policy, and who's working on it |
| `search_repo_issues` | search the repo's open and closed issues, e.g. for duplicates |
| `claim_task` | comment "I'm on it" (asks you first) |
| `get_instructions` | the guide and result format for the task type |
| `prepare_workspace` | fresh clone of the repo in your temp folder |
| `run_verify` | run the repo's checks inside Docker, with only the workspace mounted |
| `run_native_check` | for tasks tagged for your OS/GPU only: run checks directly on your machine (off by default, asks every time) |
| `submit_result` | post the result as a comment (asks you first) |
| `release_task` | give the task up (asks you first) |
| `my_contributions` | your local history |

### Safety

- Issue text is written by strangers. It reaches the agent fenced off as untrusted data, and the instructions tell the agent never to act on what's inside it.
- Work happens in a separate clone in your temp folder, not in your projects.
- A repo's code is someone else's code. The agent is told never to run it in its own terminal; it only runs through `run_verify`, inside Docker, with no access to your files. Without Docker, `run_verify` refuses unless you opt in with `verify.allow_unsandboxed` in `~/.oss-tokens/config.json`. For extra safety, use your agent's own sandbox mode too (Claude Code: `/sandbox`).
- The one exception is `run_native_check`, for bugs that only show on your OS or GPU: off unless you enable it in `init`, only for tasks tagged for your machine, approval on every run, and secrets stripped from its environment. It still runs with your user's access, so only approve repos you trust.
- Claiming, native checks, posting and releasing ask for your approval on every call in hosts that support it. Don't allow-list those tools.
- Your GitHub token is stored in `~/.oss-tokens/config.json`. Give it only the `public_repo` scope.

## Where your settings go

| What | Where |
|---|---|
| settings, token, history | `~/.oss-tokens/` |
| Claude Code MCP entry | `~/.claude.json` (`mcpServers.oss-tokens`) and the skill in `~/.claude/skills/oss-task/` |
| Cursor | `~/.cursor/mcp.json` |
| OpenCode | `~/.config/opencode/opencode.json` |
| task workspaces | `<temp>/oss-tokens/` |

`init` records every change in `~/.oss-tokens/installed.json`, and `uninstall` undoes exactly those.

## Development

```bash
npm install
npm test
node src/cli.js find          # live search
node src/cli.js init          # points your tools at this checkout
```

## Status

v0.1, early. Results are comments only; draft pull requests are planned. Not yet published to npm.
