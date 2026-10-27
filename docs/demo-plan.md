# Plan: working demo

**Status (2026-10-27):** steps 1 and 2 done. oss-tokens has 11 tools, 36 tests passing. The demo repo is built locally in `../oss-tokens-demo` (`tiny-slug`, 7 tests passing in Docker). Its 6 issues (1 closed + 5 tasks, incl. a Windows-only bug) are in `demo/issues.json`, with `demo/seed-demo-issues.mjs` to create them. Next: step 3 (publish), which needs the user's go-ahead.

Goal: one public link where anyone can see the whole loop happen for real. A maintainer posts tasks, a donor's agent picks one up, and an AI-labelled, human-approved result lands on the issue. Plus a short recording of it. That link is what we pitch with (see [outreach-targets.md](outreach-targets.md)).

## Where we are (v0.1)

| Works | Not proven yet |
|---|---|
| MCP server with 9 tools + `do-task` prompt; 23 tests pass | Posting to real GitHub (claim, result, release) |
| `init` / `uninstall` for Claude Code, Cursor, OpenCode (tested in a fake home folder) | Running inside a real Claude Code session |
| Workspace clone + patch on a real repo | Whether Claude Code honours "ask every time" on claim/submit |
| Sandboxed `run_verify` in Docker (local `node:22-alpine`) | Any second tool (Cursor/OpenCode aren't installed here) |
| Live GitHub search | Any repo using it: **0 issues on GitHub have the label today** |

## What the research says we lack

Matched against what maintainers ask for and what their AI policies require:

| Research finding | Gap in v0.1 | Fix for the demo |
|---|---|---|
| Maintainers' top asks: triage (~60%), **duplicate detection (~30%)** | Triage tells the agent to "search if you can": most agents can't search a repo's issues well | New tool `search_repo_issues`: searches the repo's open **and closed** issues |
| ~half of policies require disclosure, many in a specific form (Fedify: `Assisted-by`; others: naming model and tool) | `get_task` only *links* the repo's AI policy | `get_task` fetches the policy text (fenced as untrusted) so the agent follows the repo's own rules |
| Maintainers need to see that results help, or they switch it off | No feedback loop | Read 👍/👎 reactions on result comments; show them in `my_contributions` and `status` |
| Policies put accountability on a named human | Result comments name the donor, but nothing explains oss-tokens to a confused maintainer | Result footer links to a short "what is this / how to stop it" page |
| Small projects benefit most, but won't install anything | Nothing to fix: repo side is one YAML file + labels | Keep it that way. Write a 5-minute maintainer quickstart |

Engineering gaps:
- `init` pins its version by installing from npm, but we aren't on npm. Support installing from GitHub (`npx github:judoka11/oss-tokens init`) so the demo needs no npm publish.
- Result comments link to a placeholder (`github.com/oss-tokens/oss-tokens`). Point them at the real repo.
- The agent's token count is self-estimated. Fine for the demo; say so in the docs.

## What we need

From you:
1. **Go-ahead to create two public GitHub repos** under `judoka11`: `oss-tokens` (the tool) and `oss-tokens-demo` (the demo project). I prepare everything locally; pushing needs your GitHub login on this PC.
2. **A GitHub token** for the donor side: classic token, only the `public_repo` scope. **Type it into `init` yourself; never paste it into chat.**
3. Ideally a **second GitHub account** (or a friend) to play "maintainer", so the demo isn't you commenting on your own repo. Optional: one account works, it's just less convincing.
4. Screen recording at the end (ScreenToGif or ShareX on Windows, both free).

Already here: Node 24, git, Docker with `node:22-alpine` cached (so checks run in seconds), Claude Code in VS Code.

## The demo project: `oss-tokens-demo`

A tiny, realistic JavaScript library, so checks run in the cached `node:22-alpine` image. For example `tiny-slug`, a URL-slug helper (~150 lines, a handful of tests), seeded with real, small problems: one issue per task type.

| Issue | Type | What's planted | A good result looks like |
|---|---|---|---|
| "Crashes when title is only emoji" | `ai:repro` | Real bug: empty string after stripping → `undefined.toLowerCase()` | "Reproduced: yes", 5-line repro, the actual error, likely cause `src/slug.js:42` |
| "Slugs lose accented letters" | `ai:triage` | Duplicate of an older **closed** issue | Finds the duplicate (needs `search_repo_issues`), lists missing info |
| "Leading dashes when title starts with punctuation" | `ai:failing-test` | Real bug, no test covers it | Patch with one failing test; `run_verify` shows it fails for the right reason |
| "README example uses old option name" | `ai:docs` | `maxLen` renamed to `maxLength` in code, README not updated | Patch fixing README, citing the code line |

`.github/ai-tasks.yml` allows all four types, with `verify: { image: node:22-alpine, command: npm test }`.

## How the demo looks (the recording)

1. **Maintainer side (15 s):** the demo repo, the `ai-tasks.yml`, four labelled issues.
2. **Donor setup (15 s):** `npx github:judoka11/oss-tokens init` → token → Claude Code → shows exactly which files it writes.
3. **In Claude Code (60 s):** `/oss-task` → lists the 4 tasks → pick the repro → approve the claim prompt (claim comment appears on GitHub) → agent works in a temp clone → `run_verify` in Docker → agent shows the draft comment → approve → posted.
4. **Result (15 s):** the issue on GitHub: AI-assisted label, model, ~token count, "reviewed by @judoka11", the repro. Maintainer reacts 👍.
5. **Off switch (5 s):** `npx github:judoka11/oss-tokens uninstall` removes everything.

## Steps

| # | Step | Who | Done when |
|---|---|---|---|
| 1 | Code gaps: `search_repo_issues`, policy text in `get_task`, reactions, install-from-GitHub, real URL, footer link + "what is this" page; **rule: never run project code outside `run_verify`**; **result-format option for strict repos** (donor's own summary + quoted AI output, Rust-style policies); **donor machine tags** (OS/GPU) for platform-specific repros; tests | me | tests pass; reviewed diff |
| 2 | Build `oss-tokens-demo` locally: library, tests, planted bugs, `ai-tasks.yml`, issue texts | me | `npm test` passes in Docker; each bug confirmed by hand |
| 3 | Publish both repos; create the 4 issues (and the old closed duplicate) | you approve, I script | issues visible on GitHub |
| 4 | Install into your real Claude Code; dry run on one task; check approval prompts appear | you + me | one real result comment posted |
| 5 | Fix whatever step 4 shows; run all 4 tasks | me | 4 good result comments |
| 6 | Record the demo, update README with link + GIF | you record, I edit | README shows the demo |
| 7 | **Offline proof on PyTorch:** run the repro workflow on ~5 real `needs reproduction` issues, results saved locally, **nothing posted** | me, you approve any downloads | 5 result write-ups |
| 8 | Draft the pitch (demo link + video + offline results); post on [dev-discuss.pytorch.org](https://dev-discuss.pytorch.org). Fallback pilot: pandas `Needs Tests` | me draft, you send | message sent |

## Risks

- **Claude Code may not honour "ask every time"** on claim/submit. Then the agent's own instructions plus normal MCP permission prompts are the only guard. Check in step 4. If it's weak, add a confirmation step inside the tool.
- **A rate-limited or new account** can make GitHub search lag for fresh issues (search indexing takes minutes). Leave a gap between creating issues and recording.
- **The demo is staged**, and people will notice. That's why step 7 asks a real project for a real pilot right after.
