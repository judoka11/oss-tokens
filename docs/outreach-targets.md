# Outreach targets

Projects to pitch oss-tokens to once the demo works. Researched 2026-10-21; star and issue counts are from the GitHub API that day ("open" = issues + PRs). Re-check each project's policy before contacting them: these change fast.

## Shortlist

| Project | Size | Why it fits | Watch out for |
|---|---|---|---|
| [goose](https://github.com/aaif-goose/goose) (AI agent, Rust) | 55k★, 503 open | An MCP agent itself, so oss-tokens runs *inside* goose: a partner, not just a repo. "Use AI any way you want." Has a public "Needs info" stage where triage/repro fits. [CONTRIBUTING](https://github.com/aaif-goose/goose/blob/main/CONTRIBUTING.md) | Large. PRs only for issues marked Ready. Wants issues "written yourself". |
| [LinkML](https://github.com/linkml/linkml) (Python) | 663★, 908 open | Small team, huge backlog, very relaxed policy. [AI_COVENANT](https://github.com/linkml/linkml/blob/main/AI_COVENANT.md) | |
| [xarray](https://github.com/pydata/xarray) (Python) | 4.2k★, 1,375 open | Maintainers keep a [CLAUDE.md](https://github.com/pydata/xarray/blob/main/CLAUDE.md). Big backlog. [AI policy](https://github.com/pydata/xarray/blob/main/doc/contribute/ai-policy.md) | Human oversight required (our approval step covers it). |
| [napari](https://github.com/napari/napari) (Python) | 2.8k★, 1,298 open | AI allowed with disclosure. Big backlog. [Policy](https://napari.org/dev/developers/contributing/ai.html) | |
| [Fedify](https://github.com/fedify-dev/fedify) (TypeScript) | 1k★, 94 open | Small, responsive. "Not due to an anti-AI stance." AI in issues is fine with a human in the loop. [AI_POLICY](https://github.com/fedify-dev/fedify/blob/main/AI_POLICY.md) | Strict: drive-by PRs closed, disclosure mandatory (we do it automatically). |
| [Kornia](https://github.com/kornia/kornia) (Python) | 11k★, 154 open | Already labels PRs AI-generated / AI-assisted / no AI. [AI_POLICY](https://github.com/kornia/kornia/blob/main/AI_POLICY.md) | |

**First picks:** goose (partnership angle), and LinkML or Fedify as the first pilot (small teams reply).

**Skip:** Homebrew and pgwatch (almost no open issues); LLVM (bans AI on good first issues); anything on a ban list: Zig, QEMU, Gentoo, NetBSD, Servo, Godot, Bevy, Pallets/Flask, yt-dlp, GIMP, libxml2, OpenJDK, and more in the full list below.

## Demand check (2026-10-27)

Open issues sitting on "waiting for exactly this help" labels, from the GitHub search API:

| Project | AI stance | Backlog that matches our task types |
|---|---|---|
| **PyTorch** (99k★) | Allowed; you're responsible; low-quality or verbose gets you blocked. Already runs AI bots (auto-triage, GreenLight reviewer) | **533 `needs reproduction`** (label literally says "Reproduce the issue that was reported. A maintainer then validates it."), 137 `triage review` |
| **Kubernetes** | Allowed with disclosure | **832 `needs-triage`**, but triage needs SIG knowledge; heavy process |
| **pandas** (50k★) | Allowed with disclosure | 55 `Needs Triage`, **44 `Needs Tests`** (= failing-test tasks) |
| **Rust** (121k★) | **Bans LLM-written comments and issue text from personal accounts** | 387 `needs-triage`, 178 `E-needs-mcve`, 96 `E-needs-test`: perfect labels, but our result comments would break their policy |
| xarray, scikit-learn, ruff, Gitea, napari | Allowed | Small (0–26 per label): well-triaged projects don't need us |
| All of GitHub | | ~124k open `needs-triage`/`needs triage`, ~1.6k `needs reproduction` |

What it means:
- **Demand is real but concentrated** in a few huge projects (PyTorch, Kubernetes, pandas). Well-run AI-friendly projects have tiny backlogs.
- **"AI-friendly for code" ≠ "OK with AI-written comments."** Rust bans exactly what we post. Product fix: an `ai-tasks.yml` option for the result format (e.g. human summary + clearly quoted AI output), or a clearly marked bot account.
- **Labelling issues for agents is already common**: ~757k issues labelled `ready-for-agent`, ~44k `agent-ready`. But a sample of the newest 100 shows solo devs labelling their own repos for their own agents (0★ repos, 74–91% opened by the owner). Nobody invites *outside* agents. White space, or no demand: unproven.
- **Main competitor: [GitHub Agentic Workflows](https://github.github.com/gh-aw/)**, where maintainers run triage/test/docs agents in their own Actions, paying for AI credits. Our edge: maintainers pay nothing, a named human answers for each result, and **donors' real machines (Windows, Mac, GPUs) can reproduce platform-specific bugs** that Linux CI runners can't.
- **Best "large + AI-positive" pitch target: PyTorch's `needs reproduction` queue.** Second: pandas `Needs Tests`.

## How to pitch

1. Demo first: link to a real result comment on a real issue.
2. Use their discussion channels (GitHub Discussions, Discord, Zulip). Never pitch by opening an issue or PR.
3. Lead with control: opt-in, comments only, they pick task types, every result human-reviewed and labelled, delete one file to stop.
4. Quote their own AI policy and show how oss-tokens follows it.
5. Ask for a small pilot: 3–5 issues needing a repro or more info. If they agree, we write the `ai-tasks.yml` for them.

## Sources

- Policy list (85+ permissive, 100+ restrictive): https://github.com/melissawm/open-source-ai-contribution-policies
- Policy compilation: https://gist.github.com/ashleywolf/d77ff4b75ee4b033ab3b69c0d74f1c60
- Studies: https://arxiv.org/html/2609.07542 (281 policies, ~83% allow AI) and https://arxiv.org/html/2605.16706 (118 policies, ~78% allow)
- What maintainers want from AI (triage ~60%, duplicates ~30%): https://github.blog/open-source/maintainers/how-github-models-can-help-open-source-maintainers-focus-on-what-matters/
- Backlog clean-up with an agent (Next.js, ~1,460 issues): https://nextjs.org/blog/how-we-closed-1500-github-issues
- AI slop backlash: https://codenote.net/en/posts/oss-ai-slop-contribution-policy-shift/ and https://www.theregister.com/2026/02/03/github_kill_switch_pull_requests_ai/
